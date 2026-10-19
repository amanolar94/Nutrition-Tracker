import React from "react";

function openPicker(event) {
  const input = event.currentTarget;
  if (input.disabled || input.readOnly) return;
  // Some browsers only open a date input from its small calendar indicator.
  // Keep the native picker, but open it from any trusted click on the field.
  try {
    input.showPicker?.();
  } catch {
    // Older/embedded browsers retain their normal native input behavior.
  }
}

export default function DateInput(props) {
  return (
    <input
      {...props}
      type="date"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (
          ["Enter", " "].includes(event.key) &&
          typeof event.currentTarget.showPicker === "function"
        ) {
          event.preventDefault();
          openPicker(event);
        }
      }}
    />
  );
}
