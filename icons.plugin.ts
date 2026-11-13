import icons from "unplugin-icons/vite";

/**
 * Solar icons as React components, shared by the app build and the tests. 24px by
 * default like the Lucide icons they replaced (classes such as size-4 still win), and
 * hidden from screen readers like Lucide did; a caller can still pass aria-hidden={false}.
 */
export function solarIcons() {
  return icons({
    compiler: "jsx",
    jsx: "react",
    iconCustomizer: async (_collection, _icon, props) => {
      props.width = "24";
      props.height = "24";
      props["aria-hidden"] = "true";
    },
  });
}
