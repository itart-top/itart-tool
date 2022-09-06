import React, {useState, useEffect} from 'react';
import ReactJson from 'react-json-view'
import { Input } from 'antd';
const { TextArea } = Input;



const ContentView = ({tool, onChange}) => {
    const [winHeight, setWinHeight] = useState(100);
    const resizeHandler = () =>  {
        setWinHeight(window.innerHeight -130)
    }
    useEffect(() => {
        resizeHandler()
        window.addEventListener('resize', resizeHandler)
        return () => {
            window.removeEventListener('resize', resizeHandler)
        }
    }, []);
    let view = <TextArea value={tool.value}
                         style={{ height: winHeight }}
                         onChange={e => onChange(tool, e.target.value)} />
    if (tool.type === "json"){
        return <ReactJson src={tool.value}
                          key = {tool.code}
                          theme="monokai" style={{ height: winHeight, overflow: "auto" }}/>
    }
    return view
};
export default ContentView;
