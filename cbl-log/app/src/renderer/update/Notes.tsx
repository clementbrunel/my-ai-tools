import { parseInline, parseNotes } from "../../main/release-notes";

/** Same rendering rules as the "Notes de version" window: bullets and paragraphs with bold / code. */
export function Notes({ body }: { body: string }) {
  const { bullets, paragraphs } = parseNotes(body);
  const inline = (text: string) =>
    parseInline(text).map((t, i) => (t.kind === "strong" ? <strong key={i}>{t.text}</strong> : t.kind === "code" ? <code key={i}>{t.text}</code> : t.text));
  return (
    <div className="update-notes">
      {paragraphs.map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
      <ul>
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>
    </div>
  );
}
