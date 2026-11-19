import { channelGroupKey, channelGroupName, channelSources, groupChannels, qualityLabel } from "@/features/live/channelGroups";
import type { ChannelItem } from "@/store/types";

const channel = (id: string, name: string, categoryId = "1") => ({ id, name, categoryId } as ChannelItem);

describe("channelGroups", () => {
  it("junta as qualidades do mesmo canal e mantém nomes diferentes separados", () => {
    const list = [
      channel("1", "Globo SP FHD"), channel("2", "Globo SP HD"), channel("3", "Globo SP [ALT]"),
      channel("4", "Globo RJ HD"), channel("5", "ESPN HD"), channel("6", "ESPN 2 HD"), channel("7", "ESPN ᴴᴰ"),
    ];
    const grouped = groupChannels(list);
    expect(grouped.map((item) => item.groupName ?? item.name)).toEqual(["Globo SP", "Globo RJ HD", "ESPN", "ESPN 2 HD"]);
    expect(grouped[0].sourceIds).toEqual(["1", "2", "3"]);
    expect(grouped[2].sourceIds).toEqual(["5", "7"]);
  });

  it("não junta canais de categorias diferentes", () => {
    const grouped = groupChannels([channel("1", "HBO HD", "a"), channel("2", "HBO SD", "b")]);
    expect(grouped).toHaveLength(2);
  });

  it("rótulos das fontes", () => {
    const list = [channel("1", "Band"), channel("2", "Band (Opção 2)"), channel("3", "Band HD"), channel("4", "Band HD")];
    expect(channelSources(list[0], list).map((source) => source.label)).toEqual(["Fonte 1", "ALT", "HD", "HD 2"]);
    expect(qualityLabel("SporTV 4K")).toBe("4K");
    expect(qualityLabel("Canal 24 Horas")).toBeNull();
    expect(channelGroupKey("Discovery - SD")).toBe(channelGroupKey("Discovery (HD)"));
    expect(channelGroupName("TNT | FHD")).toBe("TNT");
  });
});
