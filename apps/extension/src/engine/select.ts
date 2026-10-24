// Owner: C2.
export function watchSelection(_host: {
  onExplainable(text: string, rect: DOMRect): void;
  isOurUi(t: EventTarget | null): boolean;
}): () => void {
  return () => {};
}
