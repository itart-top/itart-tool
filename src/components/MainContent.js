import React, { useState, useEffect } from 'react';
import MainContentView from "./MainContentView";
import './MainContent.less';

import { Layout, Popover, Button } from 'antd';
import { MenuFoldOutlined, ArrowRightOutlined, CloseOutlined } from '@ant-design/icons';
import jsonToGo from "../plugin/json-to-go";
const { Content } = Layout;

const MainContent = ({toolChain, cancel}) => {
    const [current, setCurrent] = useState(0);
    const [chainNodes, setChainNodes] = useState([]);

    useEffect(() => {
        setCurrent(toolChain.length -1 )
        setChainNodes(toolChain.map((t, index) => {
            const node = JSON.parse(JSON.stringify(t))
            node.value = ""
            const old = chainNodes.find(n => n.code === t.code)
            if (old){
                node.value = old.value
            }
            node.do = t.do
            if (index > 0){
                try {
                    let input = chainNodes[index - 1].value
                    if (typeof input != "string") {
                        input = JSON.stringify(input)
                    }
                    node.value = node.do.call(node, input)
                } catch (e) {
                    node.value = "转化异常：" + e.toString()
                }

            }
            return node
        }))
    }, [toolChain]);

    const breadcrumb = chainNodes.map((t, index) => {
        const tag = <Button type="text" size={"small"}
                            disabled={current === index}
                            onClick={e => {
                                setCurrent(chainNodes.findIndex(item => item.code === t.code))
                            }}>
            {t.name}
        </Button>

        if (index === 0) {
            return <span className="breadcrumb-item" key={t.code}>
                {tag}
            </span>
        }
        return <span className="breadcrumb-item" key={t.code}>
            {/*<Popover placement="bottomLeft" title="Title">
                {tag}
            </Popover>*/}
            {tag}
            <Button type="text" size={"small"} shape="circle"
                                 onClick={() => cancel(t)}
                                 icon={<CloseOutlined/>} className="remove-btn"/>
        </span>
    }).reduce((accu, elem) => {
        return accu === null ? [elem] : [...accu, <ArrowRightOutlined className="arrow-separate" />, elem]
    }, null)

    const onChange = (tool, v) => {
        const newChain = [...chainNodes]
        const index = newChain.findIndex(n => n.code === tool.code)
        newChain[index] = {...newChain[index], value: v}
        for (let i = index + 1; i < newChain.length; i++) {
            const elem = newChain[i]
            let value = ""
            try {
                let input = newChain[i - 1].value
                if (typeof input != "string") {
                    input = JSON.stringify(input)
                }
                value = elem.do.call(elem, input)
            } catch (e) {
                value = "转化异常：" + e.toString()
            }
            newChain[i] = {
                ...elem, value: value
            }
        }
        setChainNodes(newChain)
    }
    let view
    if (chainNodes[current]){
        view = <MainContentView tool={chainNodes[current]} onChange={onChange}/>
    }

    return <div className="main-content">
        <div className="breadcrumb-nav">
            <Button type="text" size={"small"} icon={<MenuFoldOutlined/>}/>
            {breadcrumb}
        </div>
        <Content
            className="site-layout-background"
            style={{
                margin: 0,
                minHeight: 280,
            }}
        >
            {view}
        </Content>
    </div>
};
export default MainContent;
