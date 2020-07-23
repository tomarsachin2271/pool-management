import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { observer } from 'mobx-react';
import { useStores } from '../../contexts/storesContext';
import { ContractTypes } from '../../stores/Provider';
const Circle = require('../../assets/images/circle.svg') as string;

const rotate = keyframes`
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
`;

const Spinner = styled.img`
    animation: 2s ${rotate} linear infinite;
    width: 16px;
    height: 16px;
`;

const SpinnerWrapper = styled(Spinner)`
    margin: 0 0.25rem 0 0.25rem;
`;

const Toggle = styled.label`
    position: relative;
    display: inline-block;
    width: 42px;
    height: 24px;
    input {
        opacity: 0;
        width: 0;
        height: 0;
    }
`;

const SwitchText = styled.span`
    margin-left: 5px;
    color: #fff;
`;

const ToggleInput = styled.input`
    &:checked + span {
        background-color: var(--highlighted-selector-background);
    }
    &:checked + span:before {
        -webkit-transform: translateX(18px);
        -ms-transform: translateX(18px);
        transform: translateX(18px);
        background-color: var(--slider-main);
        background-image: url('Checkbox.svg');
        background-repeat: no-repeat;
        background-position: center;
        background-size: 14px 14px;
    }
    &:focus + span {
        box-shadow: 0 0 1px #2196f3;
    }
`;

const ToggleSlider = styled.span`
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--highlighted-selector-background);
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 18px;
    :before {
        position: absolute;
        content: '';
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: var(--input-text);
        -webkit-transition: 0.4s;
        transition: 0.4s;
        border-radius: 50%;
    }
`;

const MetaTransactionSwitch = observer(() => {
    const [metaTransactionEnabled, setMetaTransactionEnabled] = useState(false);
    const [addAuthorityInProgress, setAddAuthorityInProgresss] = useState(
        false
    );

    const {
        root: { biconomyForwarderStore, providerStore, proxyStore },
    } = useStores();

    const biconomyForwarderAddress = biconomyForwarderStore.getInstanceAddress();
    const account = providerStore.providerStatus.account;
    const activeChainId = providerStore.providerStatus.activeChainId;
    const active = providerStore.providerStatus.active;
    const dsProxyAddress = proxyStore.getInstanceAddress();

    if (!activeChainId && active) {
        throw new Error(`No chain ID specified ${activeChainId}`);
    }

    const enableMetaTransaction = async event => {
        if (dsProxyAddress) {
            setAddAuthorityInProgresss(true);
            const tx = await providerStore.sendTransaction(
                ContractTypes.DSProxy,
                dsProxyAddress,
                'setAuthority',
                [biconomyForwarderAddress]
            );
            if (tx.error) {
                setAddAuthorityInProgresss(false);
                return;
            }
            await tx.txResponse.wait(1);
            await biconomyForwarderStore.fetchMetaTransactionEnabled(
                dsProxyAddress
            );
            isMetaTransactionEnabled();
            setAddAuthorityInProgresss(false);
        } else {
            alert('First create a proxy account');
        }
    };

    const isMetaTransactionEnabled = async () => {
        setMetaTransactionEnabled(
            biconomyForwarderStore.isMetaTransactionEnabled()
        );
    };

    useEffect(() => {
        isMetaTransactionEnabled();
    }, [dsProxyAddress, biconomyForwarderStore.metaTransactionEnabled]);

    const isProxyExists = () => {
        return (
            account &&
            dsProxyAddress &&
            dsProxyAddress !== '0x0000000000000000000000000000000000000000'
        );
    };

    return (
        isProxyExists() && (
            <>
                <Toggle>
                    <ToggleInput
                        type="checkbox"
                        checked={metaTransactionEnabled || false}
                        disabled={!isProxyExists()}
                        onChange={e => enableMetaTransaction(e)}
                    />
                    <ToggleSlider></ToggleSlider>
                </Toggle>

                {!addAuthorityInProgress && !metaTransactionEnabled && (
                    <SwitchText> Enable Meta Transaction</SwitchText>
                )}
                {!addAuthorityInProgress && metaTransactionEnabled && (
                    <SwitchText> Free Deposits Enabled</SwitchText>
                )}
                {addAuthorityInProgress && (
                    <SwitchText>
                        <SpinnerWrapper src={Circle} alt="loader" /> Waiting for
                        confirmation
                    </SwitchText>
                )}
            </>
        )
    );
});

export default MetaTransactionSwitch;
