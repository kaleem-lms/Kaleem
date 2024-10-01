import 'react-i18next';

declare module 'react-i18next' {
    interface CustomTypeOptions {
        // custom namespace type if you are using namespaces
        defaultNS: 'translation';
        // define your translation JSON keys here for autocomplete support
        resources: {
            translation: {
                welcome: string;
                language: string;
            };
        };
    }
}
