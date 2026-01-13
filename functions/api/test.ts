export const onRequest: PagesFunction = async () => {
  return new Response("Backend is connected and running on the Edge!");
};
