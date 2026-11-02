/** The tree, with a slot for a person's profile opened over it. */
export default function TreeLayout({ children, drawer }: LayoutProps<"/[lang]/app/tree">) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
