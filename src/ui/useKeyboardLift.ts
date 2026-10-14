import { useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, type View } from "react-native";

/**
 * How far a full-height screen must be lifted so its bottom bar clears the keyboard.
 * KeyboardAvoidingView misjudges this on edge-to-edge Android, so measure instead: after the
 * keyboard opens, compare the screen's real bottom with the keyboard's top. Works whether or not
 * the OS already resized the window (then the overlap is 0).
 */
export function useKeyboardLift() {
  const ref = useRef<View>(null);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setLift(0);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const keyboardTop = e.endCoordinates.screenY || Dimensions.get("screen").height - e.endCoordinates.height;
        ref.current?.measureInWindow((_x, y, _w, h) => {
          const overlap = Math.round(y + h - keyboardTop);
          setLift(Math.max(0, overlap));
        });
      }, 150);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      clearTimeout(timer);
      setLift(0);
    });
    return () => {
      clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, []);

  return { ref, lift };
}
