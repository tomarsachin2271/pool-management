import { action, observable } from 'mobx';
import RootStore from './Root';
import { ContractTypes } from './Provider';

export default class BiconomyForwarder {
    @observable instance: string;
    @observable metaTransactionEnabled: boolean;
    rootStore: RootStore;

    constructor(rootStore) {
        this.rootStore = rootStore;
        this.instance = '0x676fc05B5B81952E590692CA721b19DA1f99CA69';
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
