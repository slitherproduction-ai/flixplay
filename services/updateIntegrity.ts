import { NativeModules, Platform } from "react-native";

type UpdateIntegrityNativeModule = {
  sha256(uri: string): Promise<string>;
};

function nativeModule(): UpdateIntegrityNativeModule {
  const module = NativeModules.ElvanoqUpdateIntegrity as UpdateIntegrityNativeModule | undefined;
  if (!module?.sha256) throw new Error("A validação de integridade não está disponível nesta instalação.");
  return module;
}

export async function verifyUpdateSha256(uri: string, expected: string): Promise<void> {
  if (Platform.OS !== "android") throw new Error("A instalação interna está disponível somente no Android.");
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new Error("A atualização não possui SHA-256 válido.");
  const actual = await nativeModule().sha256(uri);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error("A integridade da atualização não foi confirmada. O arquivo foi descartado.");
  }
}
