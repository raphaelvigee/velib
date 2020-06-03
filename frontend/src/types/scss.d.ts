declare module '*.scss?module' {
    const content: { [className: string]: string };
    export default content;
}
