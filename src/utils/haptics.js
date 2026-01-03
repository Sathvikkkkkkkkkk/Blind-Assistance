export const triggerVibration = (pattern = 200) => {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};

export const patterns = {
    found: [100, 50, 100], // Double tap
    danger: [500],         // Long vibration
    click: 50              // Short tick
};
