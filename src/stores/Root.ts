// Stores
import ProviderStore from 'stores/Provider';
import BlockchainFetchStore from 'stores/BlockchainFetch';
import TokenStore from 'stores/Token';
import TransactionStore from './Transaction';
import PoolStore from './Pool';
import DropdownStore from './Dropdown';
import AppSettingsStore from './AppSettings';
import ContractMetadataStore from './ContractMetadata';
import ProxyStore from './Proxy';
import MarketStore from './Market';
import AddLiquidityFormStore from './AddLiquidityForm';
import RemoveLiquidityFormStore from './RemoveLiquidityForm';
import CreatePoolFormStore from './CreatePoolForm';
import BiconomyForwarderStore from './BiconomyForwarder';
import SwapsTableStore from './SwapsTable';

export default class RootStore {
    providerStore: ProviderStore;
    blockchainFetchStore: BlockchainFetchStore;
    tokenStore: TokenStore;
    poolStore: PoolStore;
    marketStore: MarketStore;
    transactionStore: TransactionStore;
    dropdownStore: DropdownStore;
    appSettingsStore: AppSettingsStore;
    contractMetadataStore: ContractMetadataStore;
    proxyStore: ProxyStore;
    biconomyForwarderStore: BiconomyForwarderStore;
    addLiquidityFormStore: AddLiquidityFormStore;
    removeLiquidityFormStore: RemoveLiquidityFormStore;
    createPoolFormStore: CreatePoolFormStore;
    swapsTableStore: SwapsTableStore;

    constructor() {
        this.providerStore = new ProviderStore(this);
        this.blockchainFetchStore = new BlockchainFetchStore(this);
        this.tokenStore = new TokenStore(this);
        this.poolStore = new PoolStore(this);
        this.marketStore = new MarketStore(this);
        this.transactionStore = new TransactionStore(this);
        this.dropdownStore = new DropdownStore(this);
        this.appSettingsStore = new AppSettingsStore(this);
        this.contractMetadataStore = new ContractMetadataStore(this);
        this.proxyStore = new ProxyStore(this);
        this.biconomyForwarderStore = new BiconomyForwarderStore(this);
        this.addLiquidityFormStore = new AddLiquidityFormStore(this);
        this.removeLiquidityFormStore = new RemoveLiquidityFormStore(this);
        this.createPoolFormStore = new CreatePoolFormStore(this);
        this.swapsTableStore = new SwapsTableStore(this);

        this.asyncSetup().catch(e => {
            //TODO: Add retry on these fetches
            throw new Error('Async Setup Failed ' + e);
        });
    }

    async asyncSetup() {
        // !!!!!!! Add web3 stuff here.
        await this.providerStore.loadWeb3();

        await this.marketStore.fetchAssetList(
            this.contractMetadataStore.tickerSymbols
        );
        await this.marketStore.fetchAssetPrices(
            this.contractMetadataStore.tickerSymbols
        );
    }
}
