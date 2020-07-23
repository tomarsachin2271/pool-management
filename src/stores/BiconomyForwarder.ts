import { action, observable } from 'mobx';
import RootStore from './Root';
import { ContractTypes } from './Provider';

export default class BiconomyForwarder {
    @observable instance: string;
    @observable metaTransactionEnabled: boolean;
    @observable forwardApiId: string;
    rootStore: RootStore;

    constructor(rootStore) {
        this.rootStore = rootStore;
        this.instance = '0xa9186fe6d71582276fE7eCD07b9a335F25cF1bE1';
        this.forwardApiId = '82205d32-1e0a-4d60-bfb0-6396d92349c8';
    }

    getInstanceAddress = (): string => {
        return this.instance;
    };

    @action async fetchMetaTransactionEnabled(proxyAddress) {
        const { providerStore } = this.rootStore;
        if (
            proxyAddress &&
            proxyAddress !== '0x0000000000000000000000000000000000000000'
        ) {
            let proxyInstance = providerStore.getContract(
                ContractTypes.DSProxy,
                proxyAddress
            );
            if (proxyInstance) {
                let result = await proxyInstance.authority();
                if (result === this.instance) {
                    this.metaTransactionEnabled = true;
                } else {
                    this.metaTransactionEnabled = false;
                }
            }
        } else {
            this.metaTransactionEnabled = false;
        }
    }

    isMetaTransactionEnabled = (): boolean => {
        return this.metaTransactionEnabled;
    };
}
