declare module "*?script" {
  const content: string;
  export default content;
}

// CSS inline imports (Vite's ?inline query)
declare module "*.css?inline" {
  const content: string;
  export default content;
}
