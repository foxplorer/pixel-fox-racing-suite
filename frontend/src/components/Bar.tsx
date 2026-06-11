import { Bar } from "react-chartjs-2";
import { useState, useEffect } from "react";

import { 
  Chart as ChartJS,
  CategoryScale, 
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";


ChartJS.register(
  CategoryScale, 
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// interface currUser {
//   name: string;
//   handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
// }

type BarGraphProps = {
  todisplay: string
}



export const BarGraph = ({ todisplay }: BarGraphProps) => {
  const [chartlabels, setChartLabels] = useState<string[]>();
  const [chartamounts, setChartAmounts] = useState<number[]>();
  type ChartInfo = {
    name: string;
    amount: number;
  }

  useEffect(
    () => {
      const bginfo: ChartInfo[] = [];
      let rrr = todisplay;
      if (rrr) {
        let kkk = JSON.parse(rrr)!;
        let foxlength = kkk.length;
        for (let i = 0; i < foxlength; i++) {
          if (kkk[i] !== undefined) if (kkk[i].origin.data.map.subTypeData.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
              const traits = kkk[i].origin.data.map.subTypeData.traits;
              if (traits && traits[0] && traits[0].value) {
                // Filter out "Blue" from background chart
                if (traits[0].value === "Blue") {
                  // Skip this option
                } else {
                  if (bginfo.length === 0){
                    let feed = {name: traits[0].value, amount: 1};
                    bginfo.push(feed);
                  }
                  else{
                    let blength = bginfo.length;
                    let match = false;
                  for(let j = 0; j < blength; j++){
                    if (bginfo[j].name === traits[0].value){
                     //if it's in there, increase amount by one
                     bginfo[j].amount++;
                    match = true;
                    }
                 }
                 if (match === false){
                  let feed = {name: traits[0].value, amount: 1};
                  bginfo.push(feed);
                 }
                  }
                }
              }
          }
        }
        let temparray = [];
        let temparrayamounts = [];       
        for(let j = 0; j < bginfo.length; j++){
          
          temparray.push(bginfo[j].name)
          temparrayamounts.push(bginfo[j].amount)
          }
          setChartLabels(temparray);
          setChartAmounts(temparrayamounts);
      }
    },
    [todisplay] // with dependency: run every time variable changes
  )
  



  const barChartData = {
   labels: chartlabels,
   datasets: [
   {
    axis: 'y',
    responsive:true,
    label: "Background",
    data: chartamounts,
    fill:false,
    borderColor:"#36bffa",
    borderWidth: 1,
    hoverBackgroundColor:"#36bffa"
   }  
  ],

};

  const options = {};
  return (
    <Bar options={options} data={barChartData} />

  );
};


// const image = document.getElementById('image');
// const canvas = document.createElement('canvas');
// const context = canvas.getContext('2d');
// const width = image.width;
// const height = image.height;

// canvas.width = width;
// canvas.height = height;

// context.drawImage(image, 0, 0, width, height);
// And then get the value of a single pixel like this:

// const data = context.getImageData(X, Y, 1, 1).data;

// // RED   = data[0]
// // GREEN = data[1]
// // BLUE  = data[2]
// // ALPHA = data[3]


// for (let p = 0; p < jjj; i++) {
//   if (kkk[i] !== undefined) if(temparray[p].name === kkk[i].origin.data.map.subTypeData.traits[0].value){
//     if(temparray[p].id === undefined){
//       temparray[p].id = img.id;
//     }
//   }
// }

// const temparray: BGColors[] = [];

// //background options
// for (let i = 0; i < foxlength; i++) {
//   if (tempstring[i].origin.data.map.subTypeData.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
//     if (bgOptions.includes(tempstring[i].origin.data.map.subTypeData.traits[0].value)) {
//       //do nothing
//     } else {
//       bgOptions.push(tempstring[i].origin.data.map.subTypeData.traits[0].value);
//       //get bgcolors for chart
//       temparray[bgcolorcount] = {name: tempstring[i].origin.data.map.subTypeData.traits[0].value, id: undefined};
//       bgcolorcount ++;
     
//     }
//   }
// }
// //set bg colors for chart
// setBgColors(temparray);