import { createContext,useContext,useState,useEffect } from "react";

const sideBarContext = createContext();

export default sideBarContext;

function SideBarProvider({ children }) {

    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false)

    const handleResize = () =>{
        if (window.innerWidth < 768){
            setIsMobile(true)
        }
        else{
            setIsMobile(false)
        }
    }

    const toggleSideBar = () => {
        if (isMobile){
            setIsOpen(!isOpen);
        }
        else{
            setIsCollapsed(!isCollapsed)
        }

    }

    useEffect(()=>{

        handleResize()
        window.addEventListener("resize",handleResize)

        return () => window.removeEventListener("resize",handleResize)

    },[])

    return(
        <sideBarContext.Provider value={{ isOpen, isCollapsed, isMobile, toggleSideBar }}>
            {children}
        </sideBarContext.Provider>
    )
}

export { SideBarProvider };

export const useSideBarContext = () => useContext(sideBarContext);