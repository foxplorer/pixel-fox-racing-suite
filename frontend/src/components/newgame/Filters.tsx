import { useCallback, useState, useEffect, useRef } from "react";
import SearchResults from "./SearchResults";
import Charts from "../Charts";
import { PulseLoader } from 'react-spinners';
import { TRAITS } from "../../constants/traits";

type FiltersProps = {
  ordinalsstring: string,
  myordinalsaddress: string,
  onFoxSelected?: (foxData: {
    originoutpoint: string;
    outpoint: string;
    owneraddress: string;
    foxes: number;
    foxname: string;
    traits?: {
      background: string;
      fox: string;
      body: string;
      mouth: string;
      headItem: string;
      eyes: string;
      item: string;
    };
  }) => void;
  // Quick View mode props
  isQuickView?: boolean;
  isFetchingFull?: boolean;
  onFetchFullOrdinals?: () => void;
  // Foxes shown with gold outline
  highlightedFoxOutpoints?: string[];
}

const Filters = ({ ordinalsstring, myordinalsaddress, onFoxSelected, isQuickView, isFetchingFull, onFetchFullOrdinals, highlightedFoxOutpoints }: FiltersProps) => {
  //loading for foxes
  const [loading, setLoading] = useState<boolean>(true);
  const [resetloading, setResetLoading] = useState<boolean>(false);
  const [setsearchloading, setSearchLoading] = useState<boolean>(false);

  //search filters
  const [background, setBackground] = useState<string>("all");
  const [name, setName] = useState<string>("all");
  const [body, setBody] = useState<string>("all");
  const [mouth, setMouth] = useState<string>("all");
  const [head, setHead] = useState<string>("all");
  const [eyes, setEyes] = useState<string>("all");
  const [item, setItem] = useState<string>("all");

  //search fields
  const [bgcheckboxes, setBgCheckboxes] = useState<string[] | undefined>();
  const [namecheckboxes, setNameCheckboxes] = useState<string[] | undefined>();
  const [bodycheckboxes, setBodyCheckboxes] = useState<string[] | undefined>();
  const [mouthcheckboxes, setMouthCheckboxes] = useState<string[] | undefined>();
  const [headcheckboxes, setHeadCheckboxes] = useState<string[] | undefined>();
  const [eyescheckboxes, setEyesCheckboxes] = useState<string[] | undefined>();
  const [itemcheckboxes, setItemCheckboxes] = useState<string[] | undefined>();

  //etc
  const [handlechangeall, setHandleChangeAll] = useState<boolean>(false);
  const [filteredordinals, setFilteredOrdinals] = useState<string>("");
  const [foxesonly, setFoxesOnly] = useState<string>("");
  const [totalresults, setTotalResults] = useState<number>(0);

  // Collection count state variables
  const [walletSaladCount, setWalletSaladCount] = useState<number>(0);
  const [walletBlueberryCount, setWalletBlueberryCount] = useState<number>(0);
  const [walletRabbitCount, setWalletRabbitCount] = useState<number>(0);

  //passed loader filters to search results
    //pass loading function to child
    const passedFunctionFromFilters = () => {
      setResetLoading(false);
    }
    const endLoading = () => {
      setResetLoading(false);
    }
    
    const setSearchLoadingDone = () => {
      setSearchLoading(false);
    }

    // Track previous foxesonly to prevent unnecessary updates
    // Use special marker to indicate "never set" vs "set to empty"
    const prevFoxesonlyRef = useRef<string | null>(null);   

  useEffect(
    () => {
      //options arrays
      const bgOptions: string[] = [...TRAITS.background];
      const nameOptions: string[] = [...TRAITS.name];
      const bodyOptions: string[] = [...TRAITS.body];
      const mouthOptions: string[] = [...TRAITS.mouth];
      const headOptions: string[] = [...TRAITS.head];
      const eyesOptions: string[] = [...TRAITS.eyes];
      const itemOptions: string[] = [...TRAITS.item];

      let tempstring;
      tempstring = JSON.parse(ordinalsstring);
      let foxlength = tempstring.length;
      //push to new array instead of splicing
      let newstring = [];


      //purge non foxes, also make sure all traits exist, need indexer, need to query 1sat-server for foxes only
      // and look into optional chaining...why tempstring[i]? below and not the others?
      for (let i = 0; i < foxlength; i++) {     
        if(tempstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0"){
           newstring.push(tempstring[i])
        }else if (tempstring[i].data?.inscription?.file?.hash){
          // console.log(tempstring[i].data?.inscription?.file?.hash + " = has a group")
        }
      }
      foxlength = newstring.length;
      setTotalResults(newstring.length);

      // Count collections from all ordinals (not just foxes)
      let saladCount = 0;
      let blueberryCount = 0;
      let rabbitCount = 0;

      tempstring.forEach((item: any) => {
        // Check multiple possible paths for collectionId
        // Primary path: origin.data.map.subTypeData.collectionId (from gorillapool API)
        const collectionId = item.origin?.data?.map?.subTypeData?.collectionId 
          || item.origin?.data?.map?.collectionId
          || item.data?.map?.subTypeData?.collectionId
          || item.data?.map?.collectionId
          || item.map?.subTypeData?.collectionId
          || item.map?.collectionId;
        
        // Also check for name field which might identify the item type
        // Primary path: origin.data.map.name
        const mapName = item.origin?.data?.map?.name 
          || item.data?.map?.name
          || item.map?.name;
        
        if (collectionId === "66fc7495388f011d273d8ce3ab5ec667121c34084e122e64fa2bc607e469e295_0" || mapName === "salad") {
          saladCount++;
        } else if (collectionId === "d0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0" || mapName === "blueberries") {
          blueberryCount++;
        } else if (collectionId === "c37ae9cedf11c4fde02a3fee2f0b5d89926a7052ff7c3206fe1a9366b4a76013_0" || mapName === "rabbit") {
          rabbitCount++;
        }
      });

      setWalletSaladCount(saladCount);
      setWalletBlueberryCount(blueberryCount);
      setWalletRabbitCount(rabbitCount);

      //set ordinals after purging non foxes by collection id
        for (let i = 0; i < foxlength; i++) {     
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[0] && traits[0].value) {
            if (bgOptions.includes(traits[0].value)) {
              //do nothing
            } else {
              bgOptions.push(traits[0].value);
            }
          }
        }
      }
      //background options
      for (let i = 0; i < foxlength; i++) {     
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[0] && traits[0].value) {
            if (bgOptions.includes(traits[0].value)) {
              //do nothing
            } else {
              bgOptions.push(traits[0].value);
            }
          }
        }
      }
      //fox name options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[1] && traits[1].value) {
            if (nameOptions.includes(traits[1].value)) {
              //do nothing
            } else {
              nameOptions.push(traits[1].value);
            }
          }
        }
      }
      //body options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[2] && traits[2].value) {
            if (bodyOptions.includes(traits[2].value)) {
              //do nothing
            } else {
              bodyOptions.push(traits[2].value);
            }
          }
        }
      }
      //mouthOptions options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[3] && traits[3].value) {
            if (mouthOptions.includes(traits[3].value)) {
              //do nothing
            } else {
              mouthOptions.push(traits[3].value);
            }
          }
        }
      }
      //headOptions options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[4] && traits[4].value) {
            if (headOptions.includes(traits[4].value)) {
              //do nothing
            } else {
              headOptions.push(traits[4].value);
            }
          }
        }
      }
      //eyesOptions options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[5] && traits[5].value) {
            if (eyesOptions.includes(traits[5].value)) {
              //do nothing
            } else {
              eyesOptions.push(traits[5].value);
            }
          }
        }
      }
      //itemOptions options
      for (let i = 0; i < foxlength; i++) {
        if (newstring[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          const traits = newstring[i].origin?.data?.map?.subTypeData?.traits;
          if (traits && traits[6] && traits[6].value) {
            if (itemOptions.includes(traits[6].value)) {
              //do nothing
            } else {
              itemOptions.push(traits[6].value);
            }
          }
        }
      }
      setBgCheckboxes(bgOptions)
      setNameCheckboxes(nameOptions)
      setBodyCheckboxes(bodyOptions)
      setMouthCheckboxes(mouthOptions)
      setHeadCheckboxes(headOptions)
      setEyesCheckboxes(eyesOptions)
      setItemCheckboxes(itemOptions)


      // Don't set loading=false here - wait until filteredordinals is set in handleChange()

      // Only update foxesonly if the fox IDs actually changed (prevents double flash)
      // Compare by origin outpoints only, not full object (different sources may have different structures)
      const newFoxIds = newstring.map((f: any) => f.origin?.outpoint).filter(Boolean).sort().join(',');
      const prevFoxIds = prevFoxesonlyRef.current;
      // Always update on first run (prevFoxIds === null) or if IDs changed
      if (prevFoxIds === null || newFoxIds !== prevFoxIds) {
        prevFoxesonlyRef.current = newFoxIds;
        setFoxesOnly(JSON.stringify(newstring));
      }
    },
    [ordinalsstring] // Re-run when ordinalsstring changes (e.g., when merged ordinals arrive)
  )

  //handlechange
  const handleChange = useCallback(() => {
    //clear foxes
    //not needed

    // Safety guard - don't process if foxesonly is empty
    if (!foxesonly || foxesonly === "") {
      return;
    }

    //get json data
    let jjj = JSON.parse(foxesonly);
    //sort foxes
    let temmp = "kjddj";
    var nietos = [];
    let nnn = jjj.length;

    //2.0 search
    for (let i = 0; i < nnn; i++) {
      //get fox json vars with safe access
      const traits = jjj[i].origin?.data?.map?.subTypeData?.traits;
      let mybg = traits && traits[0] ? traits[0].value : undefined;
      let myfox = traits && traits[1] ? traits[1].value : undefined;
      let mybody = traits && traits[2] ? traits[2].value : undefined;
      let mymouth = traits && traits[3] ? traits[3].value : undefined;
      let myhead = traits && traits[4] ? traits[4].value : undefined;
      let myeyes = traits && traits[5] ? traits[5].value : undefined;
      let myitem = traits && traits[6] ? traits[6].value : undefined;

      //push if we have a match
      if (((background === mybg) || (background === "all"))
        && ((name === myfox) || (name === "all"))
        && ((body === mybody) || (body === "all"))
        && ((mouth === mymouth) || (mouth === "all"))
        && ((head === myhead) || (head === "all"))
        && ((eyes === myeyes) || (eyes === "all"))
        && ((item === myitem) || (item === "all"))) {
        nietos.push(jjj[i]);
      }
    }
    temmp = JSON.stringify(nietos);

    //set ordinals search results variable
    setFilteredOrdinals(temmp);

    // Now that filteredordinals is set, we can stop loading
    setLoading(false);
  }, [background, body, eyes, foxesonly, head, item, mouth, name]);

  useEffect(() => {
    // Only skip if foxesonly is empty (initial state)
    // Once foxesonly has data (even "[]"), call handleChange to set filteredordinals
    if (!foxesonly || foxesonly === "" || handlechangeall) {
      return;
    }
    handleChange();
  }, [background, body, eyes, foxesonly, handleChange, handlechangeall, head, item, mouth, name]);


  //initial fox display when ordinals state changes
  const clearFilters = async () => {
    setResetLoading(true);
    setSearchLoading(true);
    setHandleChangeAll(true);

    const bgDropdown = (document.getElementById("bgReset")) as HTMLSelectElement;
    bgDropdown.selectedIndex = 0; // no error
    setBackground("all");

    const nameDropdown = (document.getElementById("nameReset")) as HTMLSelectElement;
    nameDropdown.selectedIndex = 0; // no error
    setName("all");

    const bodyDropdown = (document.getElementById("bodyReset")) as HTMLSelectElement;
    bodyDropdown.selectedIndex = 0; // no error
    setBody("all");

    const mouthDropdown = (document.getElementById("mouthReset")) as HTMLSelectElement;
    mouthDropdown.selectedIndex = 0; // no error
    setMouth("all");

    const headDropdown = (document.getElementById("headReset")) as HTMLSelectElement;
    headDropdown.selectedIndex = 0; // no error
    setHead("all");

    const eyesDropdown = (document.getElementById("eyesReset")) as HTMLSelectElement;
    eyesDropdown.selectedIndex = 0; // no error
    setEyes("all");

    const itemDropdown = (document.getElementById("itemReset")) as HTMLSelectElement;
    itemDropdown.selectedIndex = 0; // no error
    setItem("all");

    setHandleChangeAll(false);
    setTimeout(() => {
      endLoading();
      setSearchLoadingDone();
    }, 2000);
  
  };


  return (
    <>
      <div id="Filters">
        <h3>Filters</h3>
        <div className="CenterLoader">
        {loading && (
          <>
              <PulseLoader color="#ffffff" />
          </>
        )}
        </div>

        {/* Quick View Banner */}
        {isQuickView && !loading && totalresults > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '2px solid #36bffa',
            borderRadius: '12px',
            padding: '16px 20px',
            marginLeft: '20px',
            marginRight: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 15px rgba(54, 191, 250, 0.2)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                color: '#36bffa',
                fontWeight: 'bold',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                ⚡ QUICK VIEW MODE
              </div>
              <div style={{ color: '#a0a0a0', fontSize: '13px' }}>
                Showing first {totalresults.toLocaleString()} foxes for fast loading
              </div>
            </div>
            <button
              onClick={onFetchFullOrdinals}
              disabled={isFetchingFull}
              style={{
                background: isFetchingFull ? '#333' : 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: isFetchingFull ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: isFetchingFull ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
              }}
              onMouseOver={(e) => {
                if (!isFetchingFull) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isFetchingFull ? (
                <>
                  <PulseLoader color="#ffffff" size={8} />
                  <span>Loading...</span>
                </>
              ) : (
                <>🦊 Load All Foxes</>
              )}
            </button>
          </div>
        )}

        {!loading && (
          <>
            <ul className="FilterList">
              <li>
                {bgcheckboxes &&
                  <>
                    <label className="Label">Background</label>
                    <select className="classic" id="bgReset" onChange={(e) => {
                      const value = e.target.value;
                      setBackground(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {bgcheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {namecheckboxes &&
                  <><label className="Label">Fox</label>
                    <select id="nameReset" onChange={(e) => {
                      const value = e.target.value;
                      setName(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {namecheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {bodycheckboxes &&
                  <><label className="Label">Body</label>
                    <select id="bodyReset" onChange={(e) => {
                      const value = e.target.value;
                      setBody(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {bodycheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {mouthcheckboxes &&
                  <><label className="Label">Mouth</label>
                    <select id="mouthReset" onChange={(e) => {
                      const value = e.target.value;
                      setMouth(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {mouthcheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {headcheckboxes &&
                  <><label className="Label">Head</label>
                    <select id="headReset" onChange={(e) => {
                      const value = e.target.value;
                      setHead(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {headcheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {eyescheckboxes &&
                  <><label className="Label">Eyes</label>
                    <select id="eyesReset" onChange={(e) => {
                      const value = e.target.value;
                      setEyes(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {eyescheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }
              </li><li>
                {itemcheckboxes &&
                  <><label className="Label">Item</label>
                    <select id="itemReset" onChange={(e) => {
                      const value = e.target.value;
                      setItem(value);
                    }}>
                      <option key="all" value="all">All</option>
                      {itemcheckboxes.map(function (data) {
                        return (
                          <option key={data} value={data}>{data}</option>
                        )
                      })}
                    </select><br />
                  </>
                }

              </li>
            </ul>
            
            <button className="Clear" type="button" onClick={clearFilters} style={{ background: 'none', border: 0, padding: 0 }}>
              <u>Reset Filters</u>
            </button>
            {resetloading && (
          <>
              <div className="ResetLoader">
              <PulseLoader color="#ffffff" />
              </div>
          </>
        )}
           
          </>
        )}
      </div>
      <div>
        <Charts todisplay={filteredordinals} />
      </div>
      <div>


     
                    <SearchResults
        myordinalsaddress={myordinalsaddress}
        todisplay={filteredordinals}
        background={background}
        name={name}
        body={body}
        mouth={mouth}
        head={head}
        eyes={eyes}
        item={item}
        totalresults={totalresults}
        clearFilters={clearFilters}
        passedFunctionFromFilters={passedFunctionFromFilters}
        setsearchloading={setsearchloading}
        walletSaladCount={walletSaladCount}
        walletBlueberryCount={walletBlueberryCount}
        walletRabbitCount={walletRabbitCount}
        onFoxSelected={onFoxSelected}
        filtersLoading={loading}
        highlightedFoxOutpoints={highlightedFoxOutpoints}
      />
      

      </div>

      </>
  )
};

export default Filters;
