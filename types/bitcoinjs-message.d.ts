declare module 'bitcoinjs-message' {
  function verify(
    message: string,
    address: string,
    signature: string | Buffer,
    messagePrefix?: string,
    checkSegwitAlways?: boolean,
  ): boolean

  function sign(
    message: string,
    privateKey: Buffer,
    compressed?: boolean,
    messagePrefix?: string,
  ): Buffer

  export { verify, sign }
  export default { verify, sign }
}
