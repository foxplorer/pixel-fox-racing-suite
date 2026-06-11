

export type ExitButtonProps = {
  onClick: () => void;
};

// NOTE: Using inline styling demo but prefer styled-components or CSS classes in real app
export const ExitButton = (props: ExitButtonProps) => {
  const { onClick } = props;


  // function MouseOut(e){
  //   target.style.background="";
  // }
  return (
    
    <button 
    className="HoverButtonExit" 
    onClick={onClick}
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        margin: "5px",
        cursor: "pointer",
        fontSize: ".9rem",
        fontWeight: 700,
        color: "#36bffa",
        backgroundColor: "#000000",
        border: "3px solid #36bffa"
      }}
      >
Exit Game</button>

  );
};
