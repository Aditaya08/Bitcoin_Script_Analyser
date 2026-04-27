import { Buffer } from 'buffer';
import {
    address,
    initEccLib,
    networks,
    Transaction,
} from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import {
    classifyInputScript,
    classifyScript,
    classifyWitness,
} from '../classifiers';
import { scriptToAsm } from '../utils/script-utils';
import { parseTaprootWitness } from '../taproot';
import {
    InputAnalysis,
    OutputAnalysis,
    TxAnalysis,
} from '../types';

initEccLib(ecc);

const MEMPOOL_BASE = 'https://mempool.space/api';
const BLOCKSTREAM_BASE = 'https://blockstream.info/api';
const PROVIDERS = [MEMPOOL_BASE, BLOCKSTREAM_BASE];

interface ProviderPrevout {
    scriptpubkey?: string;
    scriptpubkey_asm?: string;
    value?: number;
}

interface ProviderVin {
    txid?: string;
    vout?: number;
    prevout?: ProviderPrevout;
}

interface ProviderTx {
    fee?: number;
    vin?: ProviderVin[];
}

export class TxFetcher {
    private async fetchWithFallback<T>(
        path: string,
        parser: (response: Response) => Promise<T>
    ): Promise<T> {
        let lastError: Error | null = null;

        for (const base of PROVIDERS) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);

            try {
                const response = await fetch(`${base}${path}`, {
                    signal: controller.signal,
                    headers: {
                        Accept: 'application/json, text/plain, */*',
                    },
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`Provider ${base} returned HTTP ${response.status}`);
                }

                return await parser(response);
            } catch (error) {
                clearTimeout(timeout);
                lastError = error instanceof Error ? error : new Error('Unknown fetch error');
            }
        }

        throw lastError ?? new Error('All providers failed');
    }

    private async fetchRawHex(txid: string): Promise<string> {
        return this.fetchWithFallback(`/tx/${txid}/hex`, async (response) => {
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
                const jsonBody = (await response.json()) as { hex?: string };
                return jsonBody.hex ?? '';
            }

            return (await response.text()).trim();
        });
    }

    private async fetchTxJson(txid: string): Promise<ProviderTx | null> {
        try {
            return await this.fetchWithFallback(`/tx/${txid}`, (response) =>
                response.json() as Promise<ProviderTx>
            );
        } catch {
            return null;
        }
    }

    private decodeAddress(scriptPubKey: Buffer): string | null {
        try {
            return address.fromOutputScript(scriptPubKey, networks.bitcoin);
        } catch {
            try {
                return address.fromOutputScript(scriptPubKey, networks.testnet);
            } catch {
                return null;
            }
        }
    }

    async fetchTxAnalysis(txid: string): Promise<TxAnalysis> {
        const [hex, txJson] = await Promise.all([
            this.fetchRawHex(txid),
            this.fetchTxJson(txid),
        ]);

        if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) {
            throw new Error('Unable to decode transaction hex');
        }

        const tx = Transaction.fromHex(hex);

        const outputs: OutputAnalysis[] = tx.outs.map((output, index) => {
            const classification = classifyScript(output.script);

            return {
                index,
                valuesSats: output.value,
                valueBtc: (output.value / 100_000_000).toFixed(8),
                scriptPubKeyHex: output.script.toString('hex'),
                scriptPubKeyAsm: classification.asm,
                scriptType: classification.scriptType,
                address: this.decodeAddress(output.script),
                opReturnDecoded: classification.opReturnDecoded ?? undefined,
                opReturnProtocol: classification.opReturnProtocol ?? undefined,
            };
        });

        const inputs: InputAnalysis[] = tx.ins.map((input, index) => {
            const providerVin = txJson?.vin?.[index];
            const prevout = providerVin?.prevout;
            const witness = input.witness.map((item) => item.toString('hex'));
            const prevoutScriptHex = prevout?.scriptpubkey;
            const prevoutScript =
                prevoutScriptHex && /^[0-9a-fA-F]*$/.test(prevoutScriptHex)
                    ? Buffer.from(prevoutScriptHex, 'hex')
                    : null;

            const scriptSigHex = input.script.toString('hex');
            const scriptSigAsm = scriptToAsm(input.script);
            const witnessClassification = classifyWitness(witness);
            const inputClassification = classifyInputScript(scriptSigHex, witness);

            let scriptType = inputClassification.scriptType;
            if (prevoutScript) {
                scriptType = classifyScript(prevoutScript).scriptType;
            }

            if (scriptType === 'NONSTANDARD' && witnessClassification.scriptType !== 'NONSTANDARD') {
                scriptType = witnessClassification.scriptType;
            }

            return {
                index,
                prevout: `${providerVin?.txid ?? Buffer.from(input.hash).reverse().toString('hex')}:${providerVin?.vout ?? input.index}`,
                sequence: input.sequence,
                scriptSigHex,
                scriptSigAsm,
                witness,
                scriptType,
                witnessType: witnessClassification.witnessType,
                taprootDetail:
                    scriptType === 'P2TR' ? parseTaprootWitness(witness) ?? undefined : undefined,
                prevoutScriptPubKeyHex: prevoutScriptHex,
                prevoutScriptPubKeyAsm: prevout?.scriptpubkey_asm,
                prevoutValueSats: prevout?.value,
            };
        });

        const outValue = outputs.reduce((sum, output) => sum + output.valuesSats, 0);
        const inValue =
            txJson?.vin?.reduce((sum, vin) => sum + (vin.prevout?.value ?? 0), 0) ?? 0;

        const feeFromProvider = txJson?.fee;
        const fee =
            typeof feeFromProvider === 'number'
                ? feeFromProvider
                : inValue > 0
                    ? Math.max(inValue - outValue, 0)
                    : 0;

        const vsize = tx.virtualSize();

        return {
            txid: tx.getId(),
            version: tx.version,
            locktime: tx.locktime,
            size: tx.byteLength(),
            vsize,
            weight: tx.weight(),
            fee,
            feerate: vsize > 0 ? Number((fee / vsize).toFixed(2)) : 0,
            inputs,
            outputs,
        };
    }
}
