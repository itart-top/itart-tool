import React from 'react';
import ReactJson from 'react-json-view'
import { Input } from 'antd';
const { TextArea } = Input;

const ContentView = ({tool, onChange}) => {

    let view = <TextArea showCount value={tool.value}
                         maxLength={100} style={{ height: 120 }}
                         onChange={e => onChange(tool, e.target.value)} />
    if (tool.code === "json"){
        return <ReactJson src={tool.value} theme="monokai"/>
    }
    return view
};
export default ContentView;
