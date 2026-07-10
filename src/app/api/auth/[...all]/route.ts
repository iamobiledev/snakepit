import { getAuth } from "@/lib/auth";

export const { GET, POST } = (() => {
  const handler = async (request: Request) => {
    return getAuth().handler(request);
  };
  return { GET: handler, POST: handler };
})();
