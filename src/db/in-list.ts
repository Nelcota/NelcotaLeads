import { sql, type Column, type SQL } from "drizzle-orm";

/**
 * `column in (values)` as a single bound parameter. D1 refuses a query with more than 100,
 * so `inArray` breaks once a list (a selection, the conversations page) grows past that.
 * An empty list matches nothing.
 */
export function inList(column: Column, values: readonly string[]): SQL {
  return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`;
}
