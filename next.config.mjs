/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ['lh3.googleusercontent.com', 'gravatar.com']
    },
    // health is a personal app with open sign-up (6 November 2026). The old invite-request page, the
    // family-or-solo chooser at /start and the "not in a family" page all now go to the front page,
    // which has the demo and sign-up.
    async redirects() {
        return [
            { source: '/request-invite', destination: '/', permanent: false },
            { source: '/start', destination: '/', permanent: false },
            { source: '/not-authorized', destination: '/', permanent: false },
        ];
    },
};

export default nextConfig;