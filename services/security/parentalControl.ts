import { NativeModules, Platform } from "react-native";
import { isValidParentalPin } from "./parentalPolicy";

export interface ParentalPinResult {
  configured: boolean;
  success: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockedUntil: number;
}

type ParentalControlNativeModule = {
  setParentalPin(pin: string): Promise<void>;
  verifyParentalPin(pin: string): Promise<ParentalPinResult>;
  getParentalPinStatus(): Promise<ParentalPinResult>;
  clearParentalPin(pin: string): Promise<ParentalPinResult>;
};

const nativeParentalControl = NativeModules.FlixPlaySecureStorage as
  | ParentalControlNativeModule
  | undefined;

function requireNativeParentalControl(): ParentalControlNativeModule {
  if (Platform.OS === "android" && nativeParentalControl) return nativeParentalControl;
  // Deliberately no AsyncStorage fallback: a parental PIN must never be kept in plaintext.
  throw new Error("Controle parental seguro indisponível nesta instalação.");
}

function assertValidPin(pin: string): void {
  if (!isValidParentalPin(pin)) {
    throw new Error("O PIN deve conter de 4 a 8 números.");
  }
}

export function isNativeParentalControlAvailable(): boolean {
  return Platform.OS === "android" && nativeParentalControl !== undefined;
}

export async function setParentalPin(pin: string): Promise<void> {
  assertValidPin(pin);
  await requireNativeParentalControl().setParentalPin(pin);
}

export async function verifyParentalPin(pin: string): Promise<ParentalPinResult> {
  assertValidPin(pin);
  return requireNativeParentalControl().verifyParentalPin(pin);
}

export async function getParentalPinStatus(): Promise<ParentalPinResult> {
  return requireNativeParentalControl().getParentalPinStatus();
}

export async function clearParentalPin(pin: string): Promise<ParentalPinResult> {
  assertValidPin(pin);
  return requireNativeParentalControl().clearParentalPin(pin);
}
