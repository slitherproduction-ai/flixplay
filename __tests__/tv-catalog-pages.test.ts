jest.mock("react-native", () => ({
  Platform: { OS: "android", isTV: true },
  NativeModules: { FlixPlayCatalogDatabase: {
    replaceAll: jest.fn(), append: jest.fn(), commitStaging: jest.fn(), catalogPage: jest.fn(),
  } },
}));

import { NativeModules } from "react-native";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { mergeTitlePage } from "@/features/catalog/display";

const db = NativeModules.FlixPlayCatalogDatabase;
const rows = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), title: String(i), streamUrl: "private" }));

beforeEach(() => jest.clearAllMocks());

it("writes bounded sanitized batches before making the new TV snapshot visible", async () => {
  await catalogDatabase.writeTvSnapshot("server", "vodMovies", rows, row => row, () => true);
  expect(db.replaceAll).toHaveBeenCalledWith("server", "vodMovies::staging", "[]");
  const batches = db.append.mock.calls.map((call: string[]) => JSON.parse(call[2]));
  expect(batches.map((batch: unknown[]) => batch.length)).toEqual([400, 400, 201]);
  expect(batches[0][0]).not.toHaveProperty("streamUrl");
  expect(db.commitStaging).toHaveBeenCalledWith("server", "vodMovies");
});

it("keeps the previous catalog if the provider changes between batches", async () => {
  let current = true;
  db.append.mockImplementationOnce(() => { current = false; });
  await catalogDatabase.writeTvSnapshot("server", "vodMovies", rows, row => row, () => current);
  expect(db.append).toHaveBeenCalledTimes(1);
  expect(db.commitStaging).not.toHaveBeenCalled();
});

it("selects the dubbed card when a variant arrives on the next page", () => {
  const cards: { title: string; year: number }[] = [];
  const index = new Map<string, number>();
  mergeTitlePage(cards, index, [{ title: "Ação [L]", year: 2020 }]);
  mergeTitlePage(cards, index, [{ title: "Ação [DUB]", year: 2020 }, { title: "Ação", year: 2024 }]);
  expect(cards.map(card => card.title)).toEqual(["Ação [DUB]", "Ação"]);
});
