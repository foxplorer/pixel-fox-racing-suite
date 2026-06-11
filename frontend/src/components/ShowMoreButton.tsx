export type ShowMoreButtonProps = {
  onClick: () => void;
  text?: string;
  variant?: 'blue' | 'green';
  size?: 'small' | 'medium';
};

// NOTE: Using inline styling demo but prefer styled-components or CSS classes in real app
export const ShowMoreButton = (props: ShowMoreButtonProps) => {
  const { onClick, text = "Show More", variant = 'blue', size = 'medium' } = props;

  const primaryColor = variant === 'green' ? '#4CAF50' : '#36bffa';

  const baseStyle = {
    padding: "1rem",
    borderRadius: "0.5rem",
    margin: "15px",
    cursor: "pointer",
    fontSize: "1rem",
    width: "250px",
    fontWeight: 700,
    color: primaryColor,
    backgroundColor: "#000000",
    border: `3px solid ${primaryColor}`,
    zIndex: "10",
    transition: "all 0.2s ease",
  } as React.CSSProperties;

  const smallStyle = size === 'small' ? {
    padding: "0.4rem 0.6rem",
    margin: "6px 6px 0 0",
    fontSize: "0.85rem",
    width: "auto",
    borderWidth: 2
  } as React.CSSProperties : {};

  return (
    <button 
      className="ShowMoreButton" 
      onClick={onClick}
      style={{ ...baseStyle, ...smallStyle }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = primaryColor;
        e.currentTarget.style.color = "#000000";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#000000";
        e.currentTarget.style.color = primaryColor;
      }}
    >
      {text}
    </button>
  );
};
