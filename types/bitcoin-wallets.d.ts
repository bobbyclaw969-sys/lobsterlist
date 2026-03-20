// Type declarations for Bitcoin wallet browser extensions

interface UnisatWallet {
  requestAccounts(): Promise<string[]>
  getAccounts(): Promise<string[]>
  signMessage(message: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string>
  getNetwork(): Promise<string>
}

interface XverseProvider {
  request(method: string, params: unknown): Promise<unknown>
}

interface LeatherProvider {
  request(method: string, params?: unknown): Promise<unknown>
}

declare global {
  interface Window {
    unisat?: UnisatWallet
    BitcoinProvider?: XverseProvider
    LeatherProvider?: LeatherProvider
  }
}

export {}
