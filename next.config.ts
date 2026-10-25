import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native ONNX inference must remain in the Node.js server runtime.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
