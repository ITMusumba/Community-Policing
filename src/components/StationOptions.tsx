import type { Doc } from "@/convex/_generated/dataModel";

/** <option>s for a station <select>, grouped by district; unconfirmed imports are labelled. */
export default function StationOptions({ stations }: { stations: Doc<"stations">[] | undefined }) {
  const districts = [...new Set((stations ?? []).map(s => s.district))].sort((a, b) => a.localeCompare(b));
  return <>{districts.map(d => <optgroup key={d} label={d}>
    {stations!.filter(s => s.district === d).sort((a, b) => a.name.localeCompare(b.name))
      .map(s => <option key={s._id} value={s._id}>{s.name}{s.verified ? "" : " (unconfirmed)"}</option>)}
  </optgroup>)}</>;
}
