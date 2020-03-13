import RootStore from 'stores/Root';
import { action, observable } from 'mobx';
import { fetchPublicPools } from 'provider/subgraph';
import { Pool } from 'types';
import { BigNumber } from '../utils/bignumber';
import { bnum } from '../utils/helpers';
import { Web3ReactContextInterface } from '@web3-react/core/dist/types';
import { ContractTypes } from './Provider';

interface PoolData {
    blockLastFetched: number;
    data: Pool;
}

interface PoolMap {
    [index: string]: PoolData;
}

export default class PoolStore {
    @observable pools: PoolMap;
    @observable poolsLoaded: boolean;
    rootStore: RootStore;

    constructor(rootStore) {
        this.rootStore = rootStore;
        this.pools = {} as PoolMap;
    }

    @action async fetchPublicPools() {
        const { providerStore, contractMetadataStore } = this.rootStore;
        // The subgraph and local block could be out of sync
        const currentBlock = providerStore.getCurrentBlockNumber();

        console.debug('[fetchPublicPools] Fetch pools');
        const pools = await fetchPublicPools(contractMetadataStore.tokenIndex);

        pools.forEach(pool => {
            this.setPool(pool.address, pool, currentBlock);
        });
        this.poolsLoaded = true;

        console.debug('[fetchPublicPools] Pools fetched & stored');
    }

    @action private setPool(
        poolAddress: string,
        newPool: Pool,
        blockFetched: number
    ) {
        const poolData = this.getPoolData(poolAddress);
        // If already exists, only overwrite if stale
        if (poolData) {
            if (blockFetched > poolData.blockLastFetched) {
                this.pools[poolAddress] = {
                    blockLastFetched: blockFetched,
                    data: newPool,
                };
            }
        } else {
            this.pools[poolAddress] = {
                blockLastFetched: blockFetched,
                data: newPool,
            };
        }
    }

    getUserShare(poolAddress: string, account: string): BigNumber | undefined {
        const userShare = this.getPool(poolAddress).shares.find(
            share => share.account === account
        );
        if (userShare) {
            console.log('userShare', userShare);
            return userShare.balance;
        } else {
            return undefined;
        }
    }

    calcUserLiquidity(poolAddress: string, account: string): BigNumber {
        const poolValue = this.rootStore.marketStore.getPortfolioValue(
            this.getPoolSymbols(poolAddress),
            this.getPoolBalances(poolAddress)
        );
        const userShare = this.getUserShare(poolAddress, account);
        if (userShare) {
            return userShare
                .div(this.getPool(poolAddress).totalShares)
                .times(poolValue);
        } else {
            return bnum(0);
        }
    }

    getPoolSymbols(poolAddress: string): string[] {
        return this.getPool(poolAddress).tokens.map(token => token.symbol);
    }

    getPoolBalances(poolAddress: string): BigNumber[] {
        return this.getPool(poolAddress).tokens.map(token => token.balance);
    }

    getPoolData(poolAddress: string): PoolData | undefined {
        if (this.pools[poolAddress]) {
            return this.pools[poolAddress];
        }
        return undefined;
    }

    getPublicPools(filter?: object): Pool[] {
        let pools: Pool[] = [];
        Object.keys(this.pools).forEach(key => {
            if (this.pools[key].data.finalized) {
                pools.push(this.pools[key].data);
            }
        });
        return pools;
    }

    getPool(poolAddress: string): Pool | undefined {
        if (this.pools[poolAddress]) {
            return this.pools[poolAddress].data;
        }
        return undefined;
    }

    getPoolTokens(poolAddress: string): string[] {
        if (!this.pools[poolAddress]) {
            throw new Error(`Pool ${poolAddress} not loaded`);
        }
        return this.pools[poolAddress].data.tokensList;
    }

    @action joinPool = async (
        web3React: Web3ReactContextInterface,
        poolAddress: string,
        poolAmountOut: BigNumber,
        maxAmountsIn: BigNumber[]
    ) => {
        const { providerStore } = this.rootStore;
        await providerStore.sendTransaction(
            web3React,
            ContractTypes.BPool,
            poolAddress,
            'joinPool',
            [
                poolAmountOut.toString(),
                maxAmountsIn.map(amount => amount.toString()),
            ]
        );
    };
}