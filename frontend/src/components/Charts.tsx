import { useState, useEffect, useRef } from "react";
import { BarGraph } from "../components/Bar";
import { BarGraphFox } from "../components/BarFox";
import { BarGraphBody } from "../components/BarBody";
import { BarGraphMouth } from "../components/BarMouth";
import { BarGraphHead } from "../components/BarHead";
import { BarGraphEyes } from "../components/BarEyes";
import { BarGraphItem } from "../components/BarItem";
import { v4 as uuidv4 } from 'uuid';
import { Button, ButtonGroup } from "@mui/material";

type ChartsProps = {
  todisplay: string,
}

const Charts = ({ todisplay }: ChartsProps) => {

  const buttons = ['Bg', 'Fox', 'Body', 'Mouth', 'Head', 'Eyes', 'Item'];
  const [selectedButton, setSelectedButton] = useState<string>(buttons[0]);
  const didMount = useRef(false);

  const [bgchart, setBg] = useState<boolean>(true);
  const [foxchart, setFox] = useState<boolean>(false);
  const [bodychart, setBody] = useState<boolean>(false);
  const [mouthchart, setMouth] = useState<boolean>(false);
  const [headchart, setHead] = useState<boolean>(false);
  const [eyeschart, setEyes] = useState<boolean>(false);
  const [itemchart, setItem] = useState<boolean>(false);

  useEffect(() => {

    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (selectedButton === "Bg") {
      setBg(true)
      setFox(false)
      setBody(false)
      setMouth(false)
      setHead(false)
      setEyes(false)
      setItem(false)
    }
    if (selectedButton === "Fox") {
      setFox(true)
      setBg(false)
      setBody(false)
      setMouth(false)
      setHead(false)
      setEyes(false)
      setItem(false)
    }
    if (selectedButton === "Body") {
      setBody(true)
      setBg(false)
      setFox(false)
      setMouth(false)
      setHead(false)
      setEyes(false)
      setItem(false)
    }
    if (selectedButton === "Mouth") {
      setMouth(true)
      setBg(false)
      setFox(false)
      setBody(false)
      setHead(false)
      setEyes(false)
      setItem(false)
    }
    if (selectedButton === "Head") {
      setHead(true)
      setBg(false)
      setFox(false)
      setBody(false)
      setMouth(false)
      setEyes(false)
      setItem(false)
    }
    if (selectedButton === "Eyes") {
      setEyes(true)
      setBg(false)
      setFox(false)
      setBody(false)
      setMouth(false)
      setHead(false)
      setItem(false)
    }
    if (selectedButton === "Item") {
      setItem(true)
      setBg(false)
      setFox(false)
      setBody(false)
      setMouth(false)
      setHead(false)
      setEyes(false)
    }

  }, [selectedButton])
  return (
    <>

      <div id="Charts">
        <div className="H3Wrapper">
        <h3>Charts</h3>
        </div>
        
        <ButtonGroup variant="outlined" size="small">
          {
            
            buttons.map(button => (<Button id={button} key={uuidv4()} sx={{ color: "#ffffff", borderColor: "#ffffff" }} onClick={() => setSelectedButton(button)} variant={selectedButton === button ? 'contained' : 'outlined'}>{button}</Button>))
          }
        </ButtonGroup>
        {bgchart && (
          <BarGraph todisplay={todisplay} />
        )}
        {foxchart && (
          <BarGraphFox todisplay={todisplay} />
        )}
        {bodychart && (
          <BarGraphBody todisplay={todisplay} />
        )}
        {mouthchart && (
          <BarGraphMouth todisplay={todisplay} />
        )}
        {headchart && (
          <BarGraphHead todisplay={todisplay} />
        )}
        {eyeschart && (
          <BarGraphEyes todisplay={todisplay} />
        )}
        {itemchart && (
          <BarGraphItem todisplay={todisplay} />
        )}
      </div>
    </>

  )
};

export default Charts;