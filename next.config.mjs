/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ['lh3.googleusercontent.com', 'gravatar.com']
    },
    // Sign-up is open to everyone (6 November 2026), so the old invite-request page sends people to Get started.
    async redirects() {
        return [{ source: '/request-invite', destination: '/start', permanent: true }];
    },
};

export default nextConfig;