import { hydratePagedChannelsWithEpg } from "@/core/live/hydrate-paged-channels";
import type { ChannelItem } from "@/store/types";

const base: ChannelItem = {
  id: "channel-1", name: "Canal 1", number: "1", streamId: "1", logo: "", categoryId: "1", categoryName: "Todos",
  streamUrl: "http://example.test/1", currentEpg: { title: "Sem programação", start: "", end: "", progress: 0 }, nextProgram: "—",
};

describe("hydratePagedChannelsWithEpg", () => {
  it("uses the refreshed in-memory EPG without changing the pager item", () => {
    const updated: ChannelItem = {
      ...base,
      currentEpg: { title: "Jornal", start: "12:00", end: "13:00", progress: 45 },
      nextProgram: "Filme",
      epgUpdatedAt: "2026-10-07T15:00:00.000Z",
    };
    const result = hydratePagedChannelsWithEpg([base], [updated]);
    expect(result[0]).toMatchObject({ currentEpg: updated.currentEpg, nextProgram: "Filme" });
    expect(base.currentEpg.title).toBe("Sem programação");
  });

  it("keeps the persisted card when no refreshed EPG is available", () => {
    expect(hydratePagedChannelsWithEpg([base], [base])[0]).toBe(base);
  });
});
