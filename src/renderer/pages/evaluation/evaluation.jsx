import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { FormGroup, FormControlLabel, Switch } from '@mui/material';

export default function Evaluation() {
  const navigate = useNavigate();
  return (
    <>
     <Toolbar />
      <div style={{ marginTop: '60px' }}>   {/* Para que el toolbar no tape el contenido */}
        
        <FormGroup>
          <FormControlLabel control={<Switch defaultChecked />} label="Label" />
          <FormControlLabel required control={<Switch />} label="Required" />
          <FormControlLabel disabled control={<Switch />} label="Disabled" />
        </FormGroup> 
      </div>
        
    </>
  );
}