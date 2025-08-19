import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
    // Important: always return the modified config
    return mergeConfig(config, {
        resolve: {
            alias: {
                '@': '/src',
            },
        },
        server: {
            allowedHosts: [
                '0f0932c4d474.ngrok-free.app',
                'localhost',
                '127.0.0.1',
                // Allow all ngrok hosts
                '.ngrok-free.app',
                '.ngrok.io',
            ],
        },
    });
};
