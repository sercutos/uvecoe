import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";

export default function Estudents() {
  const navigate = useNavigate();
  return (
    <>
     <Toolbar />
      <div style={{ marginTop: '60px' }}>   {/* Para que el toolbar no tape el contenido */}
        <p>Vista Students</p>
      </div>
        
    </>
  );
}