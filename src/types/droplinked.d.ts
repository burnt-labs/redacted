declare namespace JSX {
  interface IntrinsicElements {
    "droplinked-product": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        "product-id"?: string;
        "purchase-mode"?: "modal" | "new-tab";
      },
      HTMLElement
    >;
  }
}
