import React, { useState } from 'react';
import SideMenu from "./SideMenu";
import MainContent from "./MainContent";
import { Layout } from 'antd';
const { Content, Sider } = Layout;

const DecodePage = () => {
    const [isFolded, setIsFolded] = useState(false);

    const [toolChain, setToolChain] = useState([
        {
            name: "原始输入",
            code: "raw-input",
            value: undefined,
            do: (val) => {
                return val
            }
        }
    ]);

    const fire = v => {
        const newInstance = JSON.parse(JSON.stringify(v))
        newInstance.code += "_" + new Date().getTime()
        newInstance.do = v.do
        setToolChain([...toolChain, newInstance])
    }
    const cancel = v => {
        setToolChain(toolChain.filter(c => c.code !== v.code))
    }

    const folded = v => {
        setIsFolded(v)
    }

    return <>
        <Sider width={isFolded? 0: 280}
               style={{
                   overflow: 'auto',
                   height: '100vh',
                   position: 'fixed',
                   left: 0,
                   top: 64,
                   bottom: 0,
               }}
               className="side-background"
        >
            <SideMenu fire={fire}/>
        </Sider>
        <Content
            style={{
                padding: "10px",
                position: 'relative',
                marginLeft: isFolded? 0: "280px",
                marginTop: '64px'
            }}>
            <MainContent toolChain={toolChain} cancel={cancel} folded={folded}/>
        </Content>
    </>
}
export default DecodePage
