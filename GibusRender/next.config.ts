import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Il proxy (Basic Auth) bufferizza il corpo fino a questo limite e tronca il resto.
    // Foto max 4 MB (limite Vercel 4,5 MB); deve coincidere con MAX_BODY_BYTES.
    proxyClientMaxBodySize: "5mb",
    // Le immagini di riferimento (max 4 MB) viaggiano nelle server action: il limite predefinito è 1 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
