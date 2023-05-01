import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";

export default function Favorites() {
  const { user } = useAuth();
  if (!user) return null;

  return <Layout title="Favorites">todo</Layout>;
}
