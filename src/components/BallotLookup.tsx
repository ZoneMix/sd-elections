"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { RaceDetail, RaceRef } from "@/lib/types";
import { VOTER_LOOKUP_URL, contestsFor, lookupZip, type BallotOption } from "@/lib/ballot";
import { useSessionValue } from "@/hooks/useSessionValue";
import { useBallotContests } from "@/hooks/useBallotContests";
import { BallotView } from "./BallotView";
import { Section } from "./ui";

const ZIP_KEY = "sd-ballot-zip";
const CHOICE_KEY = "sd-ballot-area";

function optionLabel(o: BallotOption): string {
  const house = o.house === o.senate ? `District ${o.house}` : `District ${o.senate} (House ${o.house})`;
  return `${o.countyName} County, legislative ${house}`;
}

function shareLabel(share: number): string {
  if (share >= 0.995) return "all residents";
  if (share < 0.01) return "under 1% of residents";
  return `about ${Math.round(share * 100)}% of residents`;
}

export function BallotLookup({
  races,
  details,
  refreshKey,
}: {
  races: RaceRef[];
  details: Record<number, RaceDetail>;
  refreshKey: number | null;
}) {
  const [zip, setZip] = useSessionValue(ZIP_KEY);
  const [choice, setChoice] = useSessionValue(CHOICE_KEY);
  const [draft, setDraft] = useState<string | null>(null);

  const lookup = useMemo(() => (zip ? lookupZip(zip) : null), [zip]);
  const options = lookup?.status === "ok" ? lookup.options : [];
  const chosen = options.length === 1 ? options[0] : options.find((o) => o.key === choice);
  const contests = useMemo(() => (chosen ? contestsFor(chosen) : null), [chosen]);
  const ballot = useBallotContests(contests, refreshKey);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = (draft ?? zip).trim();
    setChoice("");
    setZip(value);
    setDraft(null);
  };
  const clear = () => {
    setZip("");
    setChoice("");
    setDraft(null);
  };

  return (
    <Section
      id="ballot"
      title="Your ballot"
      note="Enter a ZIP code to see the races and questions on that part of South Dakota’s ballot."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">ZIP code</span>
          {/* No `name`: if the form ever submits natively (before the page's
              script loads), the ZIP is not added to the URL or request. */}
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{5}"
            maxLength={5}
            value={draft ?? zip}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="num h-12 w-36 rounded-md border border-line-strong bg-surface px-3 text-xl tracking-wide text-fg"
          />
        </label>
        <button type="submit" className="btn-solid">
          Show my ballot
        </button>
        {zip ? (
          <button type="button" className="btn-quiet" onClick={clear}>
            Clear
          </button>
        ) : null}
      </form>
      <p className="small mt-3 mb-0">
        Your ZIP code stays on this device. It is never sent to this site’s server, and it is
        forgotten when you close this tab.
      </p>

      <div aria-live="polite">
        {lookup?.status === "invalid" ? <p className="mt-6 mb-0">Enter a 5-digit ZIP code.</p> : null}
        {lookup?.status === "outside" ? (
          <p className="mt-6 mb-0">
            That ZIP code isn’t in South Dakota, so there’s no South Dakota ballot to show for it.
          </p>
        ) : null}

        {lookup?.status === "ok" && lookup.crossState ? (
          <p className="mt-6 mb-0">
            {zip} is a neighboring state’s ZIP code that reaches into South Dakota. These are its
            South Dakota parts.
          </p>
        ) : null}

        {options.length > 1 ? (
          <fieldset className="mt-8 border-0 p-0">
            <legend className="text-lg font-semibold">
              {zip} crosses county or district lines. Which area do you live in?
            </legend>
            <div className="mt-4 grid gap-2">
              {options.map((o) => (
                <label
                  key={o.key}
                  className={`flex cursor-pointer items-baseline gap-3 rounded-md border px-4 py-3 ${
                    chosen?.key === o.key ? "border-fg" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="area"
                    value={o.key}
                    checked={chosen?.key === o.key}
                    onChange={() => setChoice(o.key)}
                    className="accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-medium">{optionLabel(o)}</span>
                    <span className="text-muted">, {shareLabel(o.share)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {zip && lookup?.status === "ok" ? (
          <p className="small mt-6 mb-0 max-w-[40rem]">
            ZIP codes can cross district lines. Confirm your exact ballot with the Secretary of
            State’s{" "}
            <a href={VOTER_LOOKUP_URL} className="link" target="_blank" rel="noopener noreferrer">
              voter information portal
            </a>
            .
          </p>
        ) : null}

        {chosen && contests ? (
          <BallotView option={chosen} contests={contests} ballot={ballot} races={races} details={details} />
        ) : null}
      </div>
    </Section>
  );
}
