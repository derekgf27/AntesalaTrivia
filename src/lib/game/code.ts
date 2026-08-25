export const LOBBY_CODE_LENGTH = 4;

export function clampLobbyCode(code: string): string {
  return code.toUpperCase().trim().slice(0, LOBBY_CODE_LENGTH);
}
