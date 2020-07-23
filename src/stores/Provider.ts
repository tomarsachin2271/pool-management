import { action, observable, ObservableMap } from 'mobx';
import RootStore from 'stores/Root';
import { ethers, Contract } from 'ethers';
import UncheckedJsonRpcSigner from 'provider/UncheckedJsonRpcSigner';
import { ActionResponse, sendAction } from './actions/actions';
import { web3Window as window } from 'provider/Web3Window';
import { backupUrls, supportedChainId, web3Modal } from 'provider/connectors';

export enum ContractTypes {
    BiconomyForwarder = 'BiconomyForwarder',
    BPool = 'BPool',
    BActions = 'BActions',
    BFactory = 'BFactory',
    DSProxy = 'DSProxy',
    DSProxyRegistry = 'DSProxyRegistry',
    TestToken = 'TestToken',
    ExchangeProxy = 'ExchangeProxy',
    ExchangeProxyCallable = 'ExchangeProxyCallable',
    Weth = 'Weth',
    Multicall = 'Multicall',
}

export const schema = {
    BiconomyForwarder: require('../abi/BiconomyForwarder').abi,
    BPool: require('../abi/BPool').abi,
    BActions: require('../abi/BActions').abi,
    BFactory: require('../abi/BFactory').abi,
    DSProxy: require('../abi/DSProxy').abi,
    DSProxyRegistry: require('../abi/DSProxyRegistry').abi,
    TestToken: require('../abi/TestToken').abi,
    ExchangeProxy: require('../abi/ExchangeProxy').abi,
    ExchangeProxyCallable: require('../abi/ExchangeProxyCallable').abi,
    Weth: require('../abi/Weth').abi,
    Multicall: require('../abi/Multicall').abi,
};

export interface ChainData {
    currentBlockNumber: number;
}

export interface Signature {
    r: string;
    s: string;
    v: number;
}

enum ERRORS {
    UntrackedChainId = 'Attempting to access data for untracked chainId',
    ContextNotFound = 'Specified context name note stored',
    BlockchainActionNoAccount = 'Attempting to do blockchain transaction with no account',
    BlockchainActionNoChainId = 'Attempting to do blockchain transaction with no chainId',
    BlockchainActionNoResponse = 'No error or response received from blockchain action',
    NoWeb3 = 'Error Loading Web3',
}

type ChainDataMap = ObservableMap<number, ChainData>;

export interface ProviderStatus {
    activeChainId: number;
    account: string;
    library: any;
    active: boolean;
    injectedLoaded: boolean;
    injectedActive: boolean;
    injectedChainId: number;
    injectedWeb3: any;
    backUpLoaded: boolean;
    backUpWeb3: any;
    error: Error;
    activeProvider: any;
}

const GAS_LIMIT_BUFFER = 0.1;

export default class ProviderStore {
    @observable chainData: ChainData;
    @observable providerStatus: ProviderStatus;
    web3Modal: any;
    rootStore: RootStore;

    constructor(rootStore) {
        this.rootStore = rootStore;
        this.chainData = { currentBlockNumber: -1 } as ChainData;
        this.web3Modal = web3Modal;
        this.providerStatus = {} as ProviderStatus;
        this.providerStatus.active = false;
        this.providerStatus.injectedLoaded = false;
        this.providerStatus.injectedActive = false;
        this.providerStatus.backUpLoaded = false;
        this.providerStatus.activeProvider = null;
        this.handleNetworkChanged = this.handleNetworkChanged.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    }

    getCurrentBlockNumber(): number {
        return this.chainData.currentBlockNumber;
    }

    async loadWeb3Modal(): Promise<void> {
        let provider = await this.web3Modal.connect();
        console.log(`[Provider] Web3Modal`);
        if (provider) await this.loadWeb3(provider);
    }

    @action setCurrentBlockNumber(blockNumber): void {
        this.chainData.currentBlockNumber = blockNumber;
    }

    @action fetchUserBlockchainData = async (account: string) => {
        const {
            transactionStore,
            tokenStore,
            contractMetadataStore,
        } = this.rootStore;

        console.debug('[Provider] fetchUserBlockchainData', {
            account,
        });

        transactionStore.checkPendingTransactions(account);
        tokenStore
            .fetchTokenBalances(
                account,
                contractMetadataStore.getTrackedTokenAddresses()
            )
            .then(result => {
                console.debug('[Fetch End - User Blockchain Data]', {
                    account,
                });
            });
    };

    // account is optional
    getProviderOrSigner(library, account) {
        console.debug('[getProviderOrSigner', {
            library,
            account,
            signer: library.getSigner(account),
        });

        return account
            ? new UncheckedJsonRpcSigner(library.getSigner(account))
            : library;
    }

    getContract(
        type: ContractTypes,
        address: string,
        signerAccount?: string
    ): ethers.Contract {
        const library = this.providerStatus.library;

        if (signerAccount) {
            return new ethers.Contract(
                address,
                schema[type],
                this.getProviderOrSigner(
                    this.providerStatus.library,
                    signerAccount
                )
            );
        }

        return new ethers.Contract(address, schema[type], library);
    }

    @action getUserSignature = (): Promise<Signature> => {
        return new Promise<Signature>(async (resolve, reject) => {
            const { transactionStore, biconomyForwarderStore } = this.rootStore;
            const account = this.providerStatus.account;
            const chainId = this.providerStatus.activeChainId;
            let signature = '';
            let web3 = this.providerStatus.injectedWeb3;
            let domainData = {
                name: 'balancer',
                version: '1',
                chainId: chainId.toString(),
                verifyingContract: biconomyForwarderStore.getInstanceAddress(),
            };
            const domainType = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ];

            const metaTransactionType = [
                { name: 'holder', type: 'address' },
                { name: 'nonce', type: 'uint256' },
            ];

            let forwarderContract = this.getContract(
                ContractTypes.BiconomyForwarder,
                biconomyForwarderStore.getInstanceAddress(),
                account
            );

            let nonce = await forwarderContract.nonces(account);
            let message = {
                holder: account,
                nonce: parseInt(nonce),
            };
            const dataToSign = JSON.stringify({
                types: {
                    EIP712Domain: domainType,
                    MetaTransaction: metaTransactionType,
                },
                domain: domainData,
                primaryType: 'MetaTransaction',
                message: message,
            });
            console.log(web3);
            web3.provider.sendAsync(
                {
                    jsonrpc: '2.0',
                    id: 999999999999,
                    method: 'eth_signTypedData_v4',
                    params: [account, dataToSign],
                },
                async function(err, response) {
                    if (err) {
                        reject(err);
                    }
                    const signature = response.result.substring(2);
                    const r = '0x' + signature.substring(0, 64);
                    const s = '0x' + signature.substring(64, 128);
                    const v = parseInt(signature.substring(128, 130), 16);
                    const sig: Signature = {
                        r: r,
                        s: s,
                        v: v,
                    };
                    resolve(sig);
                }
            );
        });
    };

    @action sendBiconomyMetaTransaction = async (
        to: string,
        apiId: string,
        params: any[]
    ): Promise<ActionResponse> => {
        const { transactionStore, biconomyForwarderStore } = this.rootStore;
        const account = this.providerStatus.account;
        let web3 = this.providerStatus.injectedWeb3;
        const contract = this.getContract(
            ContractTypes.BiconomyForwarder,
            biconomyForwarderStore.getInstanceAddress(),
            account
        );
        console.log(process.env);
        let biconomyResponse = await fetch(
            `https://api.biconomy.io/api/v2/meta-tx/native`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=utf-8',
                    // Get this API key from .env
                    'x-api-key':
                        'xszlQRYeL.ed1e51df-fb90-4b66-8397-33bdb7a04dd7',
                },
                body: JSON.stringify({
                    to: biconomyForwarderStore.getInstanceAddress(),
                    // Get this API ID from .env
                    apiId: biconomyForwarderStore.forwardApiId,
                    params: params,
                    from: account,
                }),
            }
        );

        let response: ActionResponse = {
            contract,
            action: 'forward',
            sender: account,
            data: params,
            txResponse: undefined,
            error: undefined,
        };

        if (biconomyResponse.ok) {
            let result = await biconomyResponse.json();
            console.log(result);
            if (result) {
                if (result.txHash) {
                    console.log(this.providerStatus.injectedWeb3);
                    let txResponse = await this.providerStatus.injectedWeb3.getTransaction(
                        result.txHash
                    );
                    console.log(txResponse);
                    txResponse = { hash: result.txHash };
                    if (txResponse) {
                        transactionStore.addTransactionRecord(
                            account,
                            txResponse
                        );
                        response.txResponse = txResponse;
                    }
                } else {
                    response.error = result.error || 'Meta Transaction failed';
                }
            } else {
                response.error = 'Meta Transaction failed';
            }
        } else {
            console.error(biconomyResponse.json());
            response.error = 'Meta Transaction failed';
        }
        return response;
    };

    @action sendTransaction = async (
        contractType: ContractTypes,
        contractAddress: string,
        action: string,
        params: any[],
        overrides?: any
    ): Promise<ActionResponse> => {
        const { transactionStore } = this.rootStore;
        const chainId = this.providerStatus.activeChainId;
        const account = this.providerStatus.account;

        overrides = overrides ? overrides : {};

        if (!account) {
            throw new Error(ERRORS.BlockchainActionNoAccount);
        }

        if (!chainId) {
            throw new Error(ERRORS.BlockchainActionNoChainId);
        }

        const contract = this.getContract(
            contractType,
            contractAddress,
            account
        );

        const gasLimitNumber = await contract.estimate[action](
            ...params,
            overrides
        );
        const gasLimit = gasLimitNumber.toNumber();
        const safeGasLimit = Math.floor(gasLimit * (1 + GAS_LIMIT_BUFFER));
        overrides.gasLimit = safeGasLimit;

        const response = await sendAction({
            contract,
            action,
            sender: account,
            data: params,
            overrides,
        });

        const { error, txResponse } = response;

        if (error) {
            console.warn('[Send Transaction Error', error);
        } else if (txResponse) {
            transactionStore.addTransactionRecord(account, txResponse);
        } else {
            throw new Error(ERRORS.BlockchainActionNoResponse);
        }

        return response;
    };

    @action async handleNetworkChanged(
        networkId: string | number
    ): Promise<void> {
        console.log(
            `[Provider] Network change: ${networkId} ${this.providerStatus.active}`
        );
        // network change could mean switching from injected to backup or vice-versa
        if (this.providerStatus.active) {
            await this.loadWeb3();
            const { blockchainFetchStore } = this.rootStore;
            blockchainFetchStore.setFetchLoop(true);
        }
    }

    @action async handleClose(): Promise<void> {
        console.log(`[Provider] HandleClose() ${this.providerStatus.active}`);

        if (this.providerStatus.active) await this.loadWeb3();
    }

    @action handleAccountsChanged(accounts: string[]): void {
        console.log(`[Provider] Accounts changed`);
        const {
            blockchainFetchStore,
            addLiquidityFormStore,
            removeLiquidityFormStore,
        } = this.rootStore;
        addLiquidityFormStore.closeModal();
        removeLiquidityFormStore.closeModal();

        if (accounts.length === 0) {
            this.handleClose();
        } else {
            this.providerStatus.account = accounts[0];
            // Loads pool & balance data for account
            blockchainFetchStore.setFetchLoop(true);
        }
    }

    @action async loadProvider(provider) {
        try {
            // remove any old listeners
            if (
                this.providerStatus.activeProvider &&
                this.providerStatus.activeProvider.on
            ) {
                console.log(`[Provider] Removing Old Listeners`);
                this.providerStatus.activeProvider.removeListener(
                    'chainChanged',
                    this.handleNetworkChanged
                );
                this.providerStatus.activeProvider.removeListener(
                    'accountsChanged',
                    this.handleAccountsChanged
                );
                this.providerStatus.activeProvider.removeListener(
                    'close',
                    this.handleClose
                );
                this.providerStatus.activeProvider.removeListener(
                    'networkChanged',
                    this.handleNetworkChanged
                );
            }

            if (
                this.providerStatus.library &&
                this.providerStatus.library.close
            ) {
                console.log(`[Provider] Closing Old Library.`);
                await this.providerStatus.library.close();
            }

            let web3 = new ethers.providers.Web3Provider(provider);

            if ((provider as any).isMetaMask) {
                console.log(`[Provider] MetaMask Auto Refresh Off`);
                (provider as any).autoRefreshOnNetworkChange = false;
            }

            if (provider.on) {
                console.log(`[Provider] Subscribing Listeners`);
                provider.on('chainChanged', this.handleNetworkChanged); // For now assume network/chain ids are same thing as only rare case when they don't match
                provider.on('accountsChanged', this.handleAccountsChanged);
                provider.on('close', this.handleClose);
                provider.on('networkChanged', this.handleNetworkChanged);
            }

            let network = await web3.getNetwork();

            const accounts = await web3.listAccounts();
            let account = null;
            if (accounts.length > 0) account = accounts[0];

            this.providerStatus.injectedLoaded = true;
            this.providerStatus.injectedChainId = network.chainId;
            this.providerStatus.account = account;
            this.providerStatus.injectedWeb3 = web3;
            this.providerStatus.activeProvider = provider;
            console.log(`[Provider] Provider loaded.`);
        } catch (err) {
            console.error(`[Provider] Loading Error`, err);
            this.providerStatus.injectedLoaded = false;
            this.providerStatus.injectedChainId = null;
            this.providerStatus.account = null;
            this.providerStatus.library = null;
            this.providerStatus.active = false;
            this.providerStatus.activeProvider = null;
        }
    }

    @action async loadWeb3(provider = null) {
        /*
        Handles loading web3 provider.
        Injected web3 loaded and active if chain Id matches.
        Backup web3 loaded and active if no injected or injected chain Id not correct.
        */
        if (provider === null && window.ethereum) {
            console.log(`[Provider] Loading Injected Provider`);
            await this.loadProvider(window.ethereum);
        } else if (provider) {
            console.log(`[Provider] Loading Provider`);
            await this.loadProvider(provider);
        }

        // If no injected provider or inject provider is wrong chain fall back to Infura
        if (
            !this.providerStatus.injectedLoaded ||
            this.providerStatus.injectedChainId !== supportedChainId
        ) {
            console.log(
                `[Provider] Reverting To Backup Provider.`,
                this.providerStatus
            );
            try {
                let web3 = new ethers.providers.JsonRpcProvider(
                    backupUrls[supportedChainId]
                );
                let network = await web3.getNetwork();
                this.providerStatus.injectedActive = false;
                this.providerStatus.backUpLoaded = true;
                this.providerStatus.account = null;
                this.providerStatus.activeChainId = network.chainId;
                this.providerStatus.backUpWeb3 = web3;
                this.providerStatus.library = web3;
                this.providerStatus.activeProvider =
                    backupUrls[supportedChainId];
                console.log(`[Provider] BackUp Provider Loaded & Active`);
            } catch (err) {
                console.error(`[Provider] loadWeb3 BackUp Error`, err);
                this.providerStatus.injectedActive = false;
                this.providerStatus.backUpLoaded = false;
                this.providerStatus.account = null;
                this.providerStatus.activeChainId = null;
                this.providerStatus.backUpWeb3 = null;
                this.providerStatus.library = null;
                this.providerStatus.active = false;
                this.providerStatus.activeProvider = null;
                this.providerStatus.error = new Error(ERRORS.NoWeb3);
                return;
            }
        } else {
            console.log(`[Provider] Injected provider active.`);
            this.providerStatus.library = this.providerStatus.injectedWeb3;
            this.providerStatus.activeChainId = this.providerStatus.injectedChainId;
            this.providerStatus.injectedActive = true;
            if (this.providerStatus.account)
                this.fetchUserBlockchainData(this.providerStatus.account);
        }

        this.providerStatus.active = true;
        console.log(`[Provider] Provider Active.`, this.providerStatus);
    }
}
