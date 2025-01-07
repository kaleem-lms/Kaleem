export default {
    locales: ['en', 'ar', 'fr'],  // List your supported locales
    output: 'public/locales/$LOCALE/translation.json',  // Specify where to output the translation files
    defaultNamespace: 'translation',
    createOldCatalogs: false, // Set to false if you don’t want to keep old translations
    lexers: {
        tsx: ['JsxLexer'], // Support for extracting from TypeScript (.tsx) files
    },
    keySeparator: false,  // Use false if you don't want nested keys
    namespaceSeparator: false,  // Use false if you don't use namespace in keys
};
