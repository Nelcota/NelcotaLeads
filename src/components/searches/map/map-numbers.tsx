export type MapNumber = { label: string; value: string; hint?: string };

/** The three numbers under the panel title: searches, new leads and a third per view. */
export function MapNumbers({ numbers }: { numbers: readonly MapNumber[] }) {
  return (
    <dl className="grid grid-cols-3 gap-3 border-y border-border py-4">
      {numbers.map((number) => (
        <div key={number.label} title={number.hint}>
          <dt className="text-xs text-muted-foreground">{number.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums @lg:text-2xl">{number.value}</dd>
        </div>
      ))}
    </dl>
  );
}
