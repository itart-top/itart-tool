import React from 'react';
import { CaretRightOutlined, LockOutlined, UnlockOutlined, PicRightOutlined } from '@ant-design/icons';
import { Collapse, Tag, Button } from 'antd';
import './SideMenu.less';

const { Panel } = Collapse;
const encodeButtons = [
        {
            name: "编码Unicode",
            code: "to-unicode",
            type: 1,
            value: undefined,
            do: function(val) {
                let ret='\\u';
                for(let i=0,len=val.length;i<len;i++){
                    if(i<len-1){
                        ret+=val.charCodeAt(i).toString(16)+'\\u';
                    }else if(i===len-1){
                        ret+=val.charCodeAt(i).toString(16);
                    }
                }
                return ret;
            }
        },
        {
            name: "解码Unicode",
            code: "from-unicode",
            type: 0,
            value: undefined,
            do: (val) => {
                this.value = "解码：" + val
            }
        },
        {
            name: "编码UTF-8",
            code: "to-utf-8",
            type: 1,
            value: undefined,
        },
        {
            name: "编码UTF-8",
            code: "from-utf-8",
            type: 0
        },
        {
            name: "编码ASCII",
            code: "to-ASCII",
            type: 1
        },
        {
            name: "解码ASCII",
            code: "from-ASCII",
            type: 0
        },
        {
            name: "编码URL",
            code: "to-url-encode",
            type: 1
        },
        {
            name: "解码URL",
            code: "from-url-encode",
            type: 0
        }
    ]
const formatButtons = [
    {
        name: "JSON格式化",
        code: "json",
        type: 1
    }
]

const codeGenButtons = [
    {
        name: "GO结构体",
        code: "json-to-go",
        type: 1
    }
]
const SideMenu = ({fire}) =>{

    return <Collapse
        bordered={false}
        defaultActiveKey={['1']}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        className="site-collapse-custom-collapse"
    >
        <Panel header="常用功能" key="1" className="common-panel">
            <p>
                <Tag closable>
                    编码转换
                </Tag>
                <Tag closable>
                    JSON美化
                </Tag>
                <Tag closable>
                    数据抽取
                </Tag>
            </p>
        </Panel>
        <Panel header="编码转换" key="2" className="tool-panel">
            {
                encodeButtons.map(b => {
                    return <Button onClick={() => fire(b)} type={b.type === 1? "primary":""}
                                   key={b.code}
                                   size={"small"} icon={b.type ===1 ? <LockOutlined />: <UnlockOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
        <Panel header="格式转换" key="3" className="tool-panel">
            {
                formatButtons.map(b => {
                    return <Button type={b.type === 1? "primary":""} size={"small"}
                                   key={b.code} icon={<PicRightOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
        <Panel header="代码生成" key="4" className="tool-panel">
            {
                codeGenButtons.map(b => {
                    return <Button type={b.type === 1? "primary":""} size={"small"}
                                   key={b.code} icon={<PicRightOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
    </Collapse>
};

export default SideMenu;
