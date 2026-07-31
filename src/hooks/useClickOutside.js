import { useEffect, useRef } from 'react';

export function useClickOutside(onOutsideClick) {
    const ref = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                onOutsideClick();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onOutsideClick]);

    return ref;
}